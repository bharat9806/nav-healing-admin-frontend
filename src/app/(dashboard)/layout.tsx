import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import s from './layout.module.scss';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell}>
      <Sidebar />
      <div className={s.content}>
        <Header />
        <main className={s.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
