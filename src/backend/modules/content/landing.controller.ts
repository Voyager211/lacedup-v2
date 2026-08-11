import type { Request, Response } from 'express';
import { getHomepageProducts, getActiveCategories, getActiveBrands } from '../catalog/product-sections.util';

const showLanding = async (req: Request, res: Response) => {
  try {
    const { newArrivals, bestSellers } = await getHomepageProducts();
    const categories = await getActiveCategories();
    const brands = await getActiveBrands(); // Add this

    res.render('user/landing', {
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
    console.error('Landing Page Error:', err);
    res.status(500).send('Failed to load landing page');
  }
};

export {
  showLanding
}
