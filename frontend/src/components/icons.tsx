import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const TagIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 3 7 7v13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7l-5-4Z" />
    <circle cx="12" cy="9" r="1.25" />
  </Icon>
);

export const ChatIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </Icon>
);

export const UserIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);

export const FilterIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </Icon>
);

export const BackIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
);

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
