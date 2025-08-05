"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

import {
  ArrowLeft, User, Camera, Save, X, Upload, Settings as SettingsIcon,
  Mail, Shield, Bell, Palette, Globe, HelpCircle
} from 'lucide-react';
import Image from 'next/image';

interface UserProfile {
  name: string;
  email: string;
  image: string | null;
}

export default function Settings() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    image: null
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setProfile({
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || null
      });
    }
  }, [session]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', profile.name);
      
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '프로필 업데이트에 실패했습니다.');
      }

      // 성공 시 상태 업데이트
      setIsEditing(false);
      setSelectedImage(null);
      setPreviewImage(null);
      
      // 세션 데이터 갱신
      await update();
      
      // 성공 메시지 표시
      alert('프로필이 성공적으로 업데이트되었습니다.');
      
      // 세션을 다시 가져오기 위해 강제로 갱신
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      alert(error instanceof Error ? error.message : '프로필 업데이트에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedImage(null);
    setPreviewImage(null);
    if (session?.user) {
      setProfile({
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || null
      });
    }
  };

  const getInitials = () => {
    if (profile.name) {
      return profile.name.charAt(0).toUpperCase();
    }
    if (profile.email) {
      return profile.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  if (status === 'loading') {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </>
    );
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 