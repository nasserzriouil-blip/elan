/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le home de l'utilisateur contient un package-lock.json parasite ; on fixe la
  // racine du projet pour que Next ne se trompe pas de workspace.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
