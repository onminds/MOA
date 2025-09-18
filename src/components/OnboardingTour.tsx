"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom" | "left" | "right" | "auto";

export interface TourStep {
  selector: string;
  title: string;
  content: string;
  placement?: Placement;
}

interface OnboardingTourProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  characterImageSrc?: string;
  nextLabel?: string;
  prevLabel?: string;
  doneLabel?: string;
}

function getRectForSelector(selector: string): DOMRect | null {
  try {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;
    return el.getBoundingClientRect();
  } catch {
    return null;
  }
}

export default function OnboardingTour(props: OnboardingTourProps) {
  const {
    steps,
    open,
    onClose,
    characterImageSrc = "/MOA.ico",
    nextLabel = "다음",
    prevLabel = "이전",
    doneLabel = "완료",
  } = props;

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const step = steps[index];

  // Follow target element rect
  useEffect(() => {
    if (!open) return;
    function update() {
      setRect(getRectForSelector(step?.selector));
    }
    update();
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const t = setInterval(update, 300);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      clearInterval(t);
    };
  }, [open, index, step?.selector]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tooltipStyle = useMemo(() => {
    const defaultPos = { left: 24, top: 24 } as const;
    if (!rect) {
      return {
        position: "fixed",
        left: defaultPos.left,
        top: defaultPos.top,
      } as React.CSSProperties;
    }

    // Auto placement near the element with safe margins
    const margin = 12;
    let top = rect.bottom + margin;
    let left = Math.max(16, Math.min(rect.left, window.innerWidth - 360));

    if (step?.placement === "top") top = rect.top - margin;
    if (step?.placement === "left") {
      top = rect.top;
      left = Math.max(16, rect.left - 340);
    }
    if (step?.placement === "right") {
      top = rect.top;
      left = Math.min(window.innerWidth - 360, rect.right + margin);
    }

    // Keep inside viewport for top/bottom
    if (top + 200 > window.innerHeight) top = Math.max(16, rect.top - 160);
    return { position: "fixed", top, left } as React.CSSProperties;
  }, [rect, step?.placement]);

  // 캐릭터 스타일은 툴팁 좌측에 고정 배치되도록 계산
  const characterStyle = useMemo(() => {
    const tooltipTop = (tooltipStyle as any).top ?? 24;
    const tooltipLeft = (tooltipStyle as any).left ?? 24;
    const size = 72;
    const margin = 12;
    const left = Math.max(8, tooltipLeft - size - margin);
    const top = Math.max(8, tooltipTop + 8);
    return {
      position: "fixed",
      left,
      top,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: 12,
      background: "transparent",
      pointerEvents: "none",
      boxShadow: "none",
    } as React.CSSProperties;
  }, [tooltipStyle]);

  if (!mounted) return null;
  if (!open) return null;
  if (!steps.length) return null;

  const goNext = () => {
    if (index < steps.length - 1) setIndex(index + 1);
    else onClose();
  };
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));

  return createPortal(
    <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      {/* Dimmed overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          // 투어 대상 요소가 흐려보이지 않도록 전체 블러는 제거
          // 어둡게 처리는 아래 하이라이트 링(box-shadow)에서만 적용
          background: "transparent",
        }}
      />

      {/* Target highlight ring */}
      {rect && (
        <div
          style={{
            position: "fixed",
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 12,
            // 중앙은 투명, 주변은 어둡게 처리하여 스포트라이트 효과
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 3px #fff",
            pointerEvents: "none",
            transition: "all .2s ease",
          }}
        />
      )}

      {/* Character next to tooltip (left side) */}
      <div style={characterStyle}>
        <img
          src={characterImageSrc}
          alt="onboarding character"
          style={{ width: "70%", height: "70%", objectFit: "contain" }}
        />
      </div>

      {/* Tooltip content */}
      <div
        style={{
          ...tooltipStyle,
          maxWidth: 320,
          background: "#111",
          color: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{step.title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>{step.content}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button
            onClick={goPrev}
            disabled={index === 0}
            style={{
              background: "#222",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              opacity: index === 0 ? 0.5 : 1,
            }}
          >
            {prevLabel}
          </button>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{index + 1} / {steps.length}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{ background: "transparent", color: "#bbb", padding: "8px 12px" }}
            >
              건너뛰기
            </button>
            <button
              onClick={goNext}
              style={{
                background: "#fff",
                color: "#111",
                padding: "8px 12px",
                borderRadius: 8,
                fontWeight: 700,
              }}
            >
              {index === steps.length - 1 ? doneLabel : nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


