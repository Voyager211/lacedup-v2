import type { Request, Response } from 'express';
const getAbout = async (req: Request, res: Response) => {
  try {
    res.render('user/about', {
      title: 'About Us - LacedUp',
      layout: 'user/layouts/user-layout',
      active: 'about',
      user: req.user || null
    });
  } catch (err: any) {
    console.error('About Page Error:', err);
    res.status(500).send('Failed to load about page');
  }
};

export {
  getAbout
};
