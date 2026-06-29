import { notFound } from "next/navigation";
import { TextLockTester } from "@/components/lock-debug/LockTester";
import { textLockCopy } from "../textLockCopy";

export default function Debug() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <TextLockTester copy={textLockCopy} />;
}
