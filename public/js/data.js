/* ===========================
    数据层 - 通过API从后端获取数据
    =========================== */

import { api } from './api.js';

export const allTags = [];

export async function fetchArticles(tag = null) {
  try {
    const articles = await api.getArticles(tag);
    return articles;
  } catch (err) {
    console.error('Failed to fetch articles:', err);
    return [];
  }
}

export async function fetchArticleById(id) {
  return api.getArticle(id);
}

export async function searchArticles(query) {
  try {
    return await api.search(query);
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}

export async function fetchTags() {
  try {
    const tags = await api.getTags();
    allTags.length = 0;
    allTags.push(...tags);
    return tags;
  } catch (err) {
    console.error('Failed to fetch tags:', err);
    return ['全部'];
  }
}
