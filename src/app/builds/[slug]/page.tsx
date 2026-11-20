import { BuildDetailPageView } from '@/components/BuildDetailPageView';

export default async function BuildDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BuildDetailPageView slug={slug} />;
}
