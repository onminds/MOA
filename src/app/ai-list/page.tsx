"use client";
import { useState, useEffect } from "react";

interface AIService {
  id: number;
  name: string;
  description: string;
  category: string;
  rating: number;
  url: string;
  features: string[];
  pricing: string;
  source: string;
  icon?: string;
  userCount?: number;
}

export default function AIList() {

  const [services, setServices] = useState<AIService[]>([]);
  const [filteredServices, setFilteredServices] = useState<AIService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPricing, setSelectedPricing] = useState('all');

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();

  }, [services, searchQuery, selectedCategory, selectedPricing, sortBy, selectedTags]);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/ai-services');
      const data = await response.json();

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    if (selectedPricing !== 'all') {
      filtered = filtered.filter(service => service.pricing === selectedPricing);
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'name':
          return a.name.localeCompare(b.name);

      }
    });

    setFilteredServices(filtered);
  };

    }
  };

  const getPricingBadge = (pricing: string) => {
    switch (pricing) {

    }
  };

  const handleServiceClick = (service: AIService) => {
    router.push(`/ai-tool/${service.id}`);
  };

  const formatUserCount = (userCount?: number) => {

    if (userCount >= 1000000) {
      return `${(userCount / 1000000).toFixed(1)}M`;
    } else if (userCount >= 1000) {
      return `${(userCount / 1000).toFixed(1)}K`;

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.includes('#')) {
      const suggestions = generateTagSuggestions(value);
      setTagSuggestions(suggestions);
      setShowTagSuggestions(suggestions.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

    setSearchQuery('');
    setShowTagSuggestions(false);
  };

  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

