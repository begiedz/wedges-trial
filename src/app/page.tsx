import { TextLockTester } from "@/components/TextLockTester";

import { textLockCopy } from "./textLockCopy";

export default function Home() {
  return <TextLockTester copy={textLockCopy} />;
}
