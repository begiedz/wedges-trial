import { TextLockTester } from "@/components/TextLockTester";
import { textLockCopy } from "../textLockCopy";

export default function Debug() {
  return <TextLockTester copy={textLockCopy} />;
}
