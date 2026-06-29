import Logo from "../atoms/logo";

export default function Header() {
  return (
    <header className="flex justify-center p-2">
      <a href="/">
        <Logo />
      </a>
    </header>
  );
}
