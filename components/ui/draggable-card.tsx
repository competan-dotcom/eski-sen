/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { cn } from "../../lib/utils";
import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useAnimationControls,
  PanInfo,
} from "framer-motion";
 
export const DraggableCardBody = ({
  className,
  children,
  dragConstraintsRef,
  onDrag,
  onDragStart,
  isDraggable = true,
}: {
  className?: string;
  children?: React.ReactNode;
  dragConstraintsRef?: React.RefObject<HTMLElement>;
  onDrag?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  onDragStart?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  isDraggable?: boolean;
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
 
  const springConfig = {
    stiffness: 100,
    damping: 20,
    mass: 0.5,
  };
 
  const rotateX = useSpring(
    useTransform(mouseY, [-300, 300], [25, -25]),
    springConfig,
  );
  const rotateY = useSpring(
    useTransform(mouseX, [-300, 300], [-25, 25]),
    springConfig,
  );
 
  const opacity = useSpring(
    useTransform(mouseX, [-300, 0, 300], [0.8, 1, 0.8]),
    springConfig,
  );
 
  const glareOpacity = useSpring(
    useTransform(mouseX, [-300, 0, 300], [0.2, 0, 0.2]),
    springConfig,
  );
 
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't apply hover effect while dragging
    if (cardRef.current && cardRef.current.style.transform.includes('translate3d')) return;

    const { clientX, clientY } = e;
    const { width, height, left, top } =
      cardRef.current?.getBoundingClientRect() ?? {
        width: 0,
        height: 0,
        left: 0,
        top: 0,
      };
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    mouseX.set(deltaX);
    mouseY.set(deltaY);
  };
 
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };
 
  return (
    <motion.div
      ref={cardRef}
      drag={isDraggable}
      dragConstraints={dragConstraintsRef}
      dragTransition={{ bounceStiffness: 400, bounceDamping: 20 }}
      onDrag={onDrag}
      onDragStart={(event, info) => {
        document.body.style.cursor = "grabbing";
        // Reset rotation on drag start for a smoother experience
        controls.start({
          rotateX: 0,
          rotateY: 0,
          transition: { duration: 0.2 }
        });
        onDragStart?.(event, info);
      }}
      onDragEnd={() => {
        document.body.style.cursor = "default";
      }}
      style={{
        rotateX,
        rotateY,
        opacity,
        willChange: "transform",
      }}
      animate={controls}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98, cursor: 'grabbing' }}
      whileDrag={{ 
        scale: 1.05, 
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
        cursor: 'grabbing' 
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative min-h-96 w-80 overflow-hidden rounded-md bg-neutral-100 p-6 shadow-2xl [transform-style:preserve-3d] dark:bg-neutral-900",
        className,
      )}
    >
      {children}
      <motion.div
        style={{
          opacity: glareOpacity,
          background: "radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 60%)",
          transform: "translate(-50%, -50%)",
          left: useTransform(mouseX, (v) => `${50 + v * 0.1}%`),
          top: useTransform(mouseY, (v) => `${50 + v * 0.1}%`),
          width: "200%",
          height: "200%",
        }}
        className="pointer-events-none absolute inset-0 select-none"
      />
    </motion.div>
  );
};
 
export const DraggableCardContainer = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className={cn("flex items-center justify-center [perspective:1000px]", className)}>{children}</div>
  );
};