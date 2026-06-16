import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, PERSONAS, type PersonaId } from "@/lib/personas";

export const runtime = "nodejs";

const client = new Anthropic();

interface ChatBody {
  personaId: PersonaId;
  messages: { role: "user" | "assistant"; content: string }[];
  journal?: string;
  amiName?: string;
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Requête invalide", { status: 400 });
  }

  const { personaId, messages, journal, amiName } = body;

  if (!personaId || !PERSONAS[personaId]) {
    return new Response("Persona inconnu", { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Aucun message", { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      "Clé API manquante. Copie .env.local.example en .env.local et ajoute ta clé ANTHROPIC_API_KEY.",
      { status: 500 },
    );
  }

  const system = buildSystemPrompt(personaId, { journal, amiName });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 1500,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        run.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await run.finalMessage();
        controller.close();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erreur inattendue côté serveur.";
        controller.enqueue(encoder.encode(`\n\n[Erreur : ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
