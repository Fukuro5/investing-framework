export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Investing Framework
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Personal portfolio tracker and rules-based investing framework — under
        construction. See PLANNING.md for the roadmap.
      </p>
    </div>
  );
}
