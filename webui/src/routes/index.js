import Vue from 'vue';
import Router from 'vue-router';

import Login from '@/pages/login/index';
import Index from '@/pages/home/index';
import Home from '@/pages/home/children/home';
import Monitor from '@/pages/home/children/monitor';
import Site from '@/pages/home/children/site';
import SiteData from '@/pages/home/children/site-data';
import SiteMix from '@/pages/home/children/site-mix';
import Setting from '@/pages/home/children/setting';
import About from '@/pages/home/children/about';
import HitAndRun from '@/pages/home/children/hit-and-run';
import Global from '@/pages/home/children/global';
import Point from '@/pages/home/children/point';
import BingeWatching from '@/pages/home/children/binge-watching';
import RaceRule from '@/pages/home/children/race-rule';
import RaceRuleSet from '@/pages/home/children/race-rule-set';
import LinkRule from '@/pages/home/children/link-rule';
import Douban from '@/pages/home/children/douban';
import DoubanWishes from '@/pages/home/children/douban-wishes';
import DoubanHistory from '@/pages/home/children/douban-history';
import WishDetail from '@/pages/home/children/wish-detail';
import Server from '@/pages/home/children/server';
import Shell from '@/pages/home/children/shell';
import Client from '@/pages/home/children/client';
import SearchMix from '@/pages/home/children/search-mix';
import TorrentMix from '@/pages/home/children/torrent-mix';
import TorrentHistory from '@/pages/home/children/torrent-history';
import DeleteRule from '@/pages/home/children/delete-rule';
import RssRule from '@/pages/home/children/rss-rule';
import Push from '@/pages/home/children/push';
import Rss from '@/pages/home/children/rss';
import Log from '@/pages/home/children/log';
import Tools from '@/pages/home/children/tools';
import Link from '@/pages/home/children/link';
import Proxy from '@/pages/home/children/proxy';
import Hosts from '@/pages/home/children/hosts';
import BulkLink from '@/pages/home/children/bulk-link';
import NetworkTest from '@/pages/home/children/network-test';
import LoginMTeam from '@/pages/home/children/login-mteam';

import MobileIndex from '@/pages/mobile/index';
import MobileHome from '@/pages/mobile/home';
import MobileSite from '@/pages/mobile/site';
import MobileClient from '@/pages/mobile/client';

Vue.use(Router);

const originalPush = Router.prototype.push;
Router.prototype.push = function goto (location) {
  return originalPush.call(this, location).catch(err => err);
};

const hitAndRun = {
  path: 'hit-and-run',
  component: HitAndRun,
  meta: {
    title: '????????????'
  },
  children: [
    {
      path: 'rss',
      component: Rss,
      meta: {
        title: 'Rss'
      }
    }, {
      path: 'rss-rule',
      component: RssRule,
      meta: {
        title: 'Rss ??????'
      }
    }, {
      path: 'client',
      component: Client,
      meta: {
        title: '?????????'
      }
    }, {
      path: 'delete-rule',
      component: DeleteRule,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'torrent-mix',
      component: TorrentMix,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'torrent-history',
      component: TorrentHistory,
      meta: {
        title: '????????????'
      }
    }
  ]
};

const siteMix = {
  path: 'site-mix',
  component: SiteMix,
  children: [
    {
      path: 'site-list',
      component: Site,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'site-data',
      component: SiteData,
      meta: {
        title: '????????????'
      }
    }
  ]
};

const point = {
  path: 'point',
  component: Point,
  children: [
    {
      path: 'client',
      component: Client,
      meta: {
        title: '?????????'
      }
    }, {
      path: 'server',
      component: Server,
      meta: {
        title: '?????????'
      }
    }, {
      path: 'shell/:serverId',
      component: Shell,
      meta: {
        title: '?????????'
      }
    }
  ]
};

const tools = {
  path: 'tools',
  component: Tools,
  children: [
    {
      path: 'login-mteam',
      component: LoginMTeam,
      meta: {
        title: 'MTeam ??????'
      }
    }, {
      path: 'network-test',
      component: NetworkTest,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'link',
      component: Link,
      meta: {
        title: '??????'
      }
    }, {
      path: 'hosts',
      component: Hosts,
      meta: {
        title: '?????? hosts'
      }
    }, {
      path: 'proxy',
      component: Proxy,
      meta: {
        title: 'http ??????'
      }
    }, {
      path: 'bulk-link',
      component: BulkLink,
      meta: {
        title: '????????????'
      }
    }
  ]
};

const _global = {
  path: 'global',
  component: Global,
  children: [
    {
      path: 'setting',
      component: Setting,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'push',
      component: Push,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'about',
      component: About,
      meta: {
        title: '??????'
      }
    }
  ]
};

const bingeWatching = {
  path: 'binge-watching',
  component: BingeWatching,
  children: [
    {
      path: 'search-mix',
      component: SearchMix,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'race-rule',
      component: RaceRule,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'race-rule-set',
      component: RaceRuleSet,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'link-rule',
      component: LinkRule,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'douban',
      component: Douban,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'douban-wishes',
      component: DoubanWishes,
      meta: {
        title: '????????????'
      }
    }, {
      path: 'wish-detail/:doubanId/:wishId',
      component: WishDetail,
      meta: {
        title: '??????'
      }
    }, {
      path: 'douban-history',
      component: DoubanHistory,
      meta: {
        title: '????????????'
      }
    }
  ]
};

export default new Router({
  mode: 'history',
  routes: [
    {
      path: '/',
      redirect: '/home'
    }, {
      path: '/login',
      component: Login,
      meta: {
        title: '??????'
      }
    }, {
      path: '/',
      component: Index,
      children: [
        {
          path: 'home',
          component: Home,
          meta: {
            title: '??????'
          }
        },
        hitAndRun,
        {
          path: 'monitor',
          component: Monitor,
          meta: {
            title: '????????????'
          }
        }, {
          path: 'log',
          component: Log,
          meta: {
            title: '????????????'
          }
        },
        _global,
        siteMix,
        point,
        bingeWatching,
        tools
      ]
    }, {
      path: '/mobile',
      component: MobileIndex,
      redirect: '/mobile/home',
      children: [{
        path: 'home',
        component: MobileHome,
        meta: {
          title: '??????'
        }
      }, {
        path: 'site',
        component: MobileSite,
        meta: {
          title: '????????????'
        }
      }, {
        path: 'client',
        component: MobileClient,
        meta: {
          title: '?????????'
        }
      }]
    }
  ]
});
