"use client";

import EssayEditorEmbed, { EssayEditorEmbedProps } from './EssayEditorEmbed';

export interface CoverLetterEditorEmbedProps extends Omit<EssayEditorEmbedProps, 'layout'> {
	layout?: EssayEditorEmbedProps['layout'];
}

export default function CoverLetterEditorEmbed({ layout = 'split', initialTitle = '자기소개서', ...rest }: CoverLetterEditorEmbedProps) {
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
