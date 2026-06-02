export default async function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-50">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <p className="text-sm uppercase tracking-wide text-emerald-300">
          M2 Gamified Agent
        </p>
        <h1 className="text-4xl font-semibold tracking-normal md:text-6xl">
          AI Trading Arena
        </h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-300">
          Frontend and backend are wired as a pnpm monorepo. Run both services
          from the repository root with one command.
        </p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Backend endpoint</p>
          <p className="mt-2 font-mono text-sm text-emerald-300">{apiUrl}</p>
        </div>
      </section>
    </main>
  );
}
