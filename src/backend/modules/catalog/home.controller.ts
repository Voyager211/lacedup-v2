import type { Request, Response } from 'express';
import { getHomepageProducts, getActiveCategories, getActiveBrands } from './product-sections.util';

const getHome = async (req: Request, res: Response) => {
  try {
    const { newArrivals, bestSellers } = await getHomepageProducts();
    const categories = await getActiveCategories();
    const brands = await getActiveBrands(); // Add this

    res.render('user/home', {
      title: 'Welcome',
      layout: 'user/layouts/user-layout',
      active: 'home',
      newArrivals,
      bestSellers,
      categories,
      brands, // Add this
      user: req.user || null
    });
  } catch (err: any) {
    console.error('Home Page Error:', err);
    res.status(500).send('Failed to load home page');
  }
};

export {
  getHome
}
