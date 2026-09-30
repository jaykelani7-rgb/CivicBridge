import { forwardRef, type ComponentProps } from 'react';
export default forwardRef<HTMLAnchorElement, ComponentProps<'a'>>(function PreviewLink({ href, ...props }, ref) {
  return <a ref={ref} href={href?.startsWith('/') ? `http://127.0.0.1:3101${href}` : href} {...props}/>;
});
