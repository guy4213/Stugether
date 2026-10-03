// Temporary production timing (performance investigation, see TASKS.md).
// Logs one `[perf] label=… ms=…` line per awaited step; read them back from
// the Vercel runtime logs (search "[perf]"). Set PERF_LOG=0 to silence.
export async function timed<T>(label: string, work: Promise<T>): Promise<T> {
  if (process.env.PERF_LOG === "0") return work;
  const start = performance.now();
  try {
    return await work;
  } finally {
    console.log(`[perf] label=${label} ms=${Math.round(performance.now() - start)}`);
  }
}
