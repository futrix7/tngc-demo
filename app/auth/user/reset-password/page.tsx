import { redirect } from "next/navigation"

export default function UserResetPasswordPage() {
  redirect("/auth/user/login")
}
