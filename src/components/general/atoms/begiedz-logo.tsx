type BegiedzLogoProps = {
  subdomain?: string;
  size?: number;
  textSize?: string;
  subtextSize?: string;
};

export default function BegiedzLogo({
  subdomain,
  size = 24,
  textSize = 'text-xl',
  subtextSize = 'text-base',
}: BegiedzLogoProps) {
  return (
    <div className='flex flex-row items-center gap-4'>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 108.92 108'
        fill='currentColor'
        width={size}
        height={size}
        aria-hidden='true'
      >
        <polygon points='0 108 37.23 0 60.29 0 23.06 108 0 108'></polygon>
        <polygon points='52.31 80.66 79.22 71.64 57.85 64.6 64.8 44.45 108.92 62.39 108.92 81.07 42.89 108 52.31 80.66'></polygon>
      </svg>

      <p className='font-mono'>
        {subdomain ? <span className={subtextSize}>{subdomain}.</span> : null}
        <span className={`font-bold ${textSize}`}>begiedz</span>
        <span className={subtextSize}>.dev</span>
      </p>
    </div>
  );
}
