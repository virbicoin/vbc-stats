import { HomeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function Header() {
  return (
    <header className="border-b border-[#1e3a5f]/50 bg-gradient-to-r from-[#0a0f1a] via-[#0d1421] to-[#0a0f1a] backdrop-blur-sm">
      <nav className="container-full mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <a
          href="/"
          className="nav-link group flex items-center gap-3 text-xl font-bold text-white transition-all duration-200 hover:text-blue-300"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-blue-500/20 blur-md transition-all duration-200 group-hover:bg-blue-500/30" />
            <img
              src="/VBC.svg"
              alt="VBC Logo"
              width={36}
              height={36}
              className="relative h-9 w-9"
            />
          </div>
          <span className="tracking-tight">VirBiCoin Stats</span>
        </a>
        <ul className="flex items-center space-x-1">
          <li>
            <a
              href="/"
              className="nav-link flex items-center gap-2 rounded-lg px-4 py-2 text-gray-300 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
            >
              <HomeIcon className="h-5 w-5" />
              <span className="font-medium">Dashboard</span>
            </a>
          </li>
          <li>
            <a
              href="https://explorer.digitalregion.jp/"
              className="nav-link flex items-center gap-2 rounded-lg px-4 py-2 text-gray-300 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              <span className="font-medium">Block Explorer</span>
            </a>
          </li>
          <li>
            <a
              href="https://pool.digitalregion.jp/"
              rel="noopener noreferrer"
              target="_blank"
              className="nav-link flex items-center gap-2 rounded-lg px-4 py-2 text-gray-300 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 21l6-6" />
                <path d="M3 8a7 7 0 0 1 9.9 0l3.1 3.1a2 2 0 0 1 0 2.8l-1.4 1.4a2 2 0 0 1-2.8 0L8.7 13.1" />
                <path d="M14 6l4-4" />
              </svg>
              <span className="hidden font-medium sm:inline">Mining Pool</span>
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
