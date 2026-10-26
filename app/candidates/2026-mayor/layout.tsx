import { CandidateDataNotice } from "@/components/candidate-data-notice"

export default function CandidateSpecialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <CandidateDataNotice />
    </>
  )
}
