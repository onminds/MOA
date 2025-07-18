import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions = {
  adapter: PrismaAdapter(prisma),
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
        };
      }
    })
  ],
  session: {
    strategy: "jwt" as const,
  },
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
        // 사용자의 역할 정보를 토큰에 추가
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id }
        });
        if (dbUser) {
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    async signIn({ user, account, profile }: any) {
      if (account?.provider === "google" || account?.provider === "kakao") {
        try {
          // 소셜 로그인 시 사용자가 처음 가입하는 경우 기본 사용량 설정
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          });

          if (!existingUser) {
            // 새 사용자의 기본 사용량 설정
            const newUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name,
                password: "", // 소셜 로그인은 비밀번호 불필요
              }
            });

            // 기본 사용량 설정
            await prisma.usage.createMany({
              data: [
                {
                  userId: newUser.id,
                  serviceType: "image-generate",
                  limitCount: 1,
                },
                {
                  userId: newUser.id,
                  serviceType: "ai-chat",
                  limitCount: 20,
                },
                {
                  userId: newUser.id,
                  serviceType: "code-generate",
                  limitCount: 15,
                },
                {
                  userId: newUser.id,
                  serviceType: "sns-post",
                  limitCount: 10,
                },
              ],
            });
          }
        } catch (error) {
          console.error("소셜 로그인 사용자 설정 오류:", error);
          return false;
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}; 