import { redirect } from "next/navigation"

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/student/${id}/profile`)
}
