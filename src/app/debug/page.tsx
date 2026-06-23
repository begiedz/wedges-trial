import { TextLockTester } from "@/components/text-lock/TextLockTester";
import { textLockCopy } from "../textLockCopy";

export default function Debug() {
  return <TextLockTester copy={textLockCopy} />;
}
