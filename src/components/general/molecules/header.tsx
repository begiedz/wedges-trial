import Link from "next/link";
import Logo from "../atoms/logo";

type HeaderProps = {
  homeHref: string;
  logoAlt: string;
  title: string;
};

export default function Header({ homeHref, logoAlt, title }: HeaderProps) {
  return (
    <header className="flex justify-center p-2">
      <Link href={homeHref}>
        <Logo alt={logoAlt} title={title} />
      </Link>
    </header>
  );
}
