import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions = {
  // adapter: PrismaAdapter(prisma), // JWT 세션 사용 시 주석 처리
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            image: true
          }
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        };
      }
    })
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.image = user.image;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        // 데이터베이스에서 최신 사용자 정보 가져오기
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true
            }
          });

          if (user) {
            session.user.id = user.id;
            session.user.name = user.name;
            session.user.email = user.email;
            session.user.image = user.image;
            session.user.role = user.role;
          }
        } catch (error) {
          console.error('세션에서 사용자 정보 가져오기 실패:', error);
          // 실패 시 토큰 정보 사용
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.image = token.image;
        }
      }
      return session;
    },
    async signIn({ user, account, profile }: any) {
      // credentials 로그인의 경우 항상 허용
      if (account?.provider === "credentials") {
        return true;
      }
      
      // 소셜 로그인의 경우 사용자 생성/업데이트 처리
      if (account?.provider === "google" || account?.provider === "kakao") {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          });

          if (!existingUser) {
            // 새 사용자 생성
            const newUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name,
                image: user.image,
                role: "USER"
              }
            });

            // 소셜 로그인 사용자에게 사용자 ID 설정
            user.id = newUser.id;
            user.role = newUser.role;
          } else {
            // 기존 사용자의 정보 업데이트
            user.id = existingUser.id;
            user.role = existingUser.role;
            user.image = existingUser.image;
          }

          return true;
        } catch (error) {
          console.error("소셜 로그인 오류:", error);
          return false;
        }
      }

      return true;
    },
  },
}; 