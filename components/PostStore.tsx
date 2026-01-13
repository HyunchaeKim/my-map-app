import { MOCK_POSTS } from "@/data/mockPosts";
import React, { createContext, useContext, useState } from "react";

export type Post = {
  id: string;
  userId: string;
  userName: string;
  imageUri: string;
  caption?: string;
  createdAt: number;
  likeCount: number;
};

type Ctx = {
  posts: Post[];
  addPost: (p: Post) => void;
};

const PostContext = createContext<Ctx | null>(null);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);

  const addPost = (p: Post) => {
    setPosts((prev) => [p, ...prev]);
  };

  return (
    <PostContext.Provider value={{ posts, addPost }}>
      {children}
    </PostContext.Provider>
  );
}

export function usePosts() {
  const ctx = useContext(PostContext);
  if (!ctx) throw new Error("usePosts must be used within PostProvider");
  return ctx;
}
