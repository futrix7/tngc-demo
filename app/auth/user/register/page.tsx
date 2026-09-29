import { redirect } from "next/navigation"

export default function UserRegisterPage() {
  redirect("/auth/user/login")
}
