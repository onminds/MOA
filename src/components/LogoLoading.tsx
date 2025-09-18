import React from 'react';

interface LogoLoadingProps {
	message?: string;
	subMessage?: string;
	className?: string;
	fullscreen?: boolean;
	transparentBg?: boolean;
}

export default function LogoLoading({
	message = 'AI가 생성 중',
	subMessage = '잠시만 기다려주세요',
	className,
	fullscreen = false,
	transparentBg = false,
}: LogoLoadingProps) {
	return (
		<div
			className={
				`${fullscreen ? 'fixed inset-0 z-50' : 'relative'} flex items-center justify-center ${transparentBg ? 'bg-transparent' : 'bg-white'} ${className || ''}`
			}
			aria-live="polite"
			role="status"
		>
			<div className="text-center w-full h-full flex flex-col items-center justify-center rounded-xl">
				{/* 회전 원과 MOA 텍스트 */}
				<div className="relative w-60 h-60 flex items-center justify-center" style={{ transform: 'translateY(0.25rem)' }}>
					<div className="absolute inset-0 border-2 border-black border-t-transparent rounded-full animate-spin" aria-hidden></div>
					<div className="absolute inset-6 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} aria-hidden></div>
					<div className="text-black font-bold text-5xl">MOA</div>
				</div>
				{/* 메시지는 원 아래로 분리하여 겹치지 않게 */}
				{(message || subMessage) && (
					<div className="mt-6 text-black text-base font-medium whitespace-nowrap">
						{message}
						{subMessage ? <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{subMessage}</div> : null}
					</div>
				)}
			</div>
		</div>
	);
}
