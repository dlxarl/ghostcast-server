import json
from channels.generic.websocket import AsyncWebsocketConsumer


class StreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'stream_{self.room_name}'

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'video.message',
                    'bytes': bytes_data,
                    'sender': self.channel_name
                }
            )

        if text_data:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat.message',
                    'text': text_data,
                    'sender': self.channel_name
                }
            )

    async def video_message(self, event):
        if self.channel_name != event['sender']:
            await self.send(bytes_data=event['bytes'])

    async def chat_message(self, event):
        await self.send(text_data=event['text'])