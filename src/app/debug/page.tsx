import { TextLockTester } from "@/components/lock-debug/LockTester";
import { textLockCopy } from "../textLockCopy";

export default function Debug() {
  return <TextLockTester copy={textLockCopy} />;
}
