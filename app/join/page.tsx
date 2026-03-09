import DomusApp from "../components/DomusApp";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <DomusApp initialJoinToken={params.token} />;
}
