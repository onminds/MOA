"use client";

import EssayEditorEmbed, { EssayEditorEmbedProps } from './EssayEditorEmbed';

export interface SummaryEditorEmbedProps extends Omit<EssayEditorEmbedProps, 'layout'> {
	layout?: EssayEditorEmbedProps['layout'];
}

export default function SummaryEditorEmbed({ layout = 'split', initialTitle = '요약 결과', ...rest }: SummaryEditorEmbedProps) {
	return (
		<EssayEditorEmbed
			layout={layout}
			initialTitle={initialTitle}
			suppressAssistantMessage={true}
			hideChat={false}
			autoGrow
			fixedChatInput
			styleMarkdownHeadings
			{...rest}
		/>
	);
}
