# coding: utf-8
from collections import defaultdict
import json
import os
import random
import uuid
import sys
from tornado import web, ioloop
import sockjs.tornado
from tornado.options import define, options

X_SYM = 'x'
O_SYM = 'o'

define('host', default='127.0.0.1')
define('port', default='9991')


class IndexHandler(web.RequestHandler):
    def get(self):
        self.render('index.html')


class TTTConnector(sockjs.tornado.SockJSConnection):
    waitings = set()
    games = defaultdict(set)
    game_id = None
    player_name = None

    def recipients(self):
        if self.game_id and self.game_id in self.games:
            return self.games.get(self.game_id)
        return self,

    def on_open(self, info):
        print('Player joined.')

    def join(self):
        try:
            opponent = self.waitings.pop()
            if opponent.game_id:
                self.game_id = opponent.game_id
                self.games[self.game_id] = {opponent, self}
                symbols = random.sample([X_SYM, O_SYM], 2)

                for symb, pl in zip(symbols, self.recipients()):
                    pl_op = (self.recipients()-{pl}).pop()
                    msg = {'type': 'start',
                           'text': u'Игра началась.',
                           'symbol': symb,
                           'opponent': pl_op.player_name,
                           }
                    self.broadcast((pl,), json.dumps(msg))
        except KeyError:
            self.game_id = uuid.uuid4()
            self.waitings.add(self)
            msg = {'type': 'waiting',
                   'text': u'Ждем соперника...'}
            self.broadcast(self.recipients(), json.dumps(msg))

    def on_message(self, message):
        try:
            msg = json.loads(message)
            if msg['type'] == 'name':
                self.player_name = msg['value']
                print(self.player_name)
                self.join()
            else:
                self.broadcast(self.recipients(), message)
        except ValueError:
            pass
        finally:
            print(message)

    def on_close(self):
        print('Socket close')
        try:
            self.waitings.remove(self)
        except KeyError:
            try:
                players = self.games.pop(self.game_id)
                msg = {'type': 'disconnect',
                       'text': u"Соперник вышел из игры. Игра закончена"}
                self.broadcast(players, json.dumps(msg))
                for player in players:
                    player.close()
            except KeyError:
                pass

    @classmethod
    def dump_stats(cls):
        if len(cls.waitings):
            print('Waiting: %d' % len(cls.waitings))
        if len(cls.games):
            print('Gamers: %d' % len(cls.games))


if __name__ == '__main__':
    TTTRouter = sockjs.tornado.SockJSRouter(TTTConnector, '/game')

    settings = {
        'debug': True,
        'template_path': os.path.join(os.path.dirname(__file__), 'templates'),
        'static_path': os.path.join(os.path.dirname(__file__), 'static'),
    }
    try:
        app = web.Application(
            [(r'/', IndexHandler)] + TTTRouter.urls,
            **settings
        )
        app.listen(port=options.port, address=options.host)
        print('Started...')
        # ioloop.PeriodicCallback(TTTConnector.dump_stats, 1000).start()
        ioloop.IOLoop.instance().start()
    except KeyboardInterrupt:
        ioloop.IOLoop.instance().stop()
        sys.exit()
