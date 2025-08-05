import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";

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

    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,

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

      }
    })
  ],
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {

      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.image = user.image;

      }
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {

        }
      }
      return session;
    },
    async signIn({ user, account, profile }: any) {

      if (account?.provider === "credentials") {
        return true;
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