import React, { useState } from 'react';
import { SiGithub, SiX, SiBitcoin, SiDiscord, SiTelegram } from 'react-icons/si';

const Footer = () => {
  const [year] = useState<number>(() => new Date().getFullYear());

  return (
    <footer className="border-t border-[#1e3a5f]/50 bg-gradient-to-r from-[#0a0f1a] via-[#0d1421] to-[#0a0f1a]">
      <div className="container-full mx-auto flex items-center justify-center px-4 py-4 text-gray-400">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">&copy; 2024-{year} Digitalregion, Inc.</span>
          <span className="text-[#1e3a5f]">|</span>
          <a
            href="https://github.com/virbicoin/vbcstats"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
          >
            <SiGithub className="h-4 w-4" />
            <span>vbcstats</span>
          </a>
          <span className="text-[#1e3a5f]">|</span>
          <a
            href="https://x.com/VirBiCoin"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
          >
            <SiX className="h-4 w-4" />
          </a>
          <a
            href="https://bitcointalk.org/index.php?topic=5546988.0"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
          >
            <SiBitcoin className="h-4 w-4" />
          </a>
          <a
            href="https://discord.digitalregion.jp"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
          >
            <SiDiscord className="h-4 w-4" />
          </a>
          <a
            href="https://t.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-400"
          >
            <SiTelegram className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
