import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
export function Button({children,asChild=false,variant='default',size='default'}:{children:ReactNode;asChild?:boolean;variant?:'default'|'outline';size?:'default'|'sm'|'lg'}) {
  const className=`original-button original-button-${variant} original-button-size-${size}`;
  if(asChild){const child=Children.only(children);if(isValidElement(child)){const element=child as ReactElement<{className?:string}>;return cloneElement(element,{className:[className,element.props.className].filter(Boolean).join(' ')});}}
  return <button className={className}>{children}</button>;
}
