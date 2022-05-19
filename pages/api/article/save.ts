import { NextApiRequest, NextApiResponse } from 'next';
import { withIronSessionApiRoute } from 'iron-session/next';
import { ironOptions } from 'pages/api/config/index';
import { ISession } from 'pages/api/index';
import { prepareConnection } from 'db/index';
import { User, Article, Tag } from 'db/entity/index';
import { EXCEPTION_ARTICLE } from 'pages/api/config/resCode';

export default withIronSessionApiRoute(save, ironOptions);

async function save(req: NextApiRequest, res: NextApiResponse) {
  const session: ISession = req.session;
  const {
    id = 0,
    title = '',
    content = '',
    tagIds = [],
    rel_id = 0,
  } = req.body;
  const db = await prepareConnection();
  const userRepo = db.getRepository(User);
  const articleRepo = db.getRepository(Article);
  const tagRepo = db.getRepository(Tag);

  const user = await userRepo.findOne({
    id: session.id,
  });

  const tags = await tagRepo.find({
    where: tagIds?.map((tagId: number) => ({ id: tagId })),
  });

  // 如果有rel_id，说明已经发布过，现在要发布为草稿，保留原文章
  // 如果id = 0，说明是新建草稿
  if (rel_id || id === 0) {
    const article = new Article();
    article.title = title;
    article.content = content;
    article.is_draft = true;
    article.create_time = new Date();
    article.update_time = new Date();
    article.rel_id = rel_id;

    if (user) {
      article.user = user;
    }

    const newTags = tags?.map((tag) => {
      tag.article_count = tag?.article_count + 1;
      return tag;
    });
    article.tags = newTags;
    const resArticle = await articleRepo.save(article);
    if (resArticle) {
      res.status(200).json({ data: resArticle, code: 0, msg: '保存成功' });
    } else {
      res.status(200).json({ ...EXCEPTION_ARTICLE.SAVE_FAILED });
    }
    // 该文章仅发布为草稿过
  } else if (id) {
    const article = await articleRepo.findOne({
      where: {
        id,
      },
      relations: ['user'],
    });
    if (article) {
      article.title = title;
      article.content = content;
      article.is_draft = true;
      article.update_time = new Date();

      const newTags = tags?.map((tag) => {
        tag.article_count = tag?.article_count + 1;
        return tag;
      });
      article.tags = newTags;

      const resArticle = await articleRepo.save(article);

      if (resArticle) {
        res.status(200).json({ data: resArticle, code: 0, msg: '保存成功' });
      } else {
        res.status(200).json({ ...EXCEPTION_ARTICLE.SAVE_FAILED });
      }
    }
  }
}