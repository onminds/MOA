import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  const { name, email, subject, message } = await request.json();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ message: '모든 필드를 입력해주세요.' }, { status: 400 });
  }

  // Nodemailer transporter를 Gmail에 맞게 설정
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465
    auth: {
      user: process.env.SMTP_USER, // 보내는 사람 Gmail 주소
      pass: process.env.SMTP_PASS, // Gmail 앱 비밀번호
    },
  });

  try {
    // 이메일 전송
    await transporter.sendMail({
      from: process.env.SMTP_USER, // 보내는 사람
      to: process.env.SMTP_TO_EMAIL, // 받는 사람
      replyTo: email,
      subject: `[MOA 문의] ${subject}`, // 제목
      html: `
        <h1>새로운 문의가 도착했습니다.</h1>
        <p><strong>보낸 사람 이름:</strong> ${name}</p>
        <p><strong>보낸 사람 이메일:</strong> ${email}</p>
        <hr />
        <h2>${subject}</h2>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    return NextResponse.json({ message: '메시지가 성공적으로 전송되었습니다.' }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: '메시지 전송에 실패했습니다.' }, { status: 500 });
  }
}

