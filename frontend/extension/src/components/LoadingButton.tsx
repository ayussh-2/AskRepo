import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { ComponentProps } from "react";

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  loading?: boolean;
}

export default function LoadingButton({ loading, children, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={loading} {...props}>
      {loading && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  );
}