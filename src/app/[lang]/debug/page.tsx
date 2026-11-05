import { notFound } from "next/navigation";
import { TextLockTester } from "@/features/lock-debug";

export default function Debug() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TextLockTester />;
}
