import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <img src="/favicon.svg" alt="Logo" className="mb-6 h-14 w-14 opacity-50" />
      <h1 className="text-6xl font-extrabold text-primary">404</h1>
      <p className="mt-3 text-xl font-semibold text-brand-black">Page not found</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        That page doesn't exist. You may have followed a broken link.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Back to Home
      </Link>
    </div>
  );
}
