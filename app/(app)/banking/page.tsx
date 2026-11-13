import { BankingOverviewPage } from "@/features/banking/overview";

export default async function Page({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  return <BankingOverviewPage result={(await searchParams).result} />;
}
