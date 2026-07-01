import type { ReactNode } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Dashboard from '@/Dashboard';

export default function App(): ReactNode {
  return (
    <>
      <Header />
      <Dashboard />
      <Footer />
    </>
  );
}
