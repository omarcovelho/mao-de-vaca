import { PageHeader } from './page-header';

type ComingSoonPageProps = {
  title: string;
  subtitle: string;
  message: string;
};

export function ComingSoonPage({ title, subtitle, message }: ComingSoonPageProps) {
  return (
    <section className="page">
      <PageHeader title={title} subtitle={subtitle} />
      <p className="page__empty">{message}</p>
    </section>
  );
}
