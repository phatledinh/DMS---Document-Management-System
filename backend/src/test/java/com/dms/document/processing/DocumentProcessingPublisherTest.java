package com.dms.document.processing;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class DocumentProcessingPublisherTest {
    @Test
    void publish_sendsPersistentMessageToTasksExchange() throws Exception {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        ApplicationEventPublisher applicationEventPublisher = mock(ApplicationEventPublisher.class);
        DocumentProcessingPublisher publisher = new DocumentProcessingPublisher(rabbitTemplate, applicationEventPublisher);
        DocumentProcessingMessage message = DocumentProcessingMessage.extract(42L, null, "documents/object", "application/pdf");

        publisher.publish(DocumentProcessingRabbitConfig.EXTRACT_ROUTING_KEY, message);

        ArgumentCaptor<MessagePostProcessor> postProcessorCaptor = ArgumentCaptor.forClass(MessagePostProcessor.class);
        verify(rabbitTemplate).convertAndSend(
                eq(DocumentProcessingRabbitConfig.TASKS_EXCHANGE),
                eq(DocumentProcessingRabbitConfig.EXTRACT_ROUTING_KEY),
                eq(message),
                postProcessorCaptor.capture()
        );
        Message rabbitMessage = new Message(new byte[0]);
        postProcessorCaptor.getValue().postProcessMessage(rabbitMessage);
        assertThat(rabbitMessage.getMessageProperties().getDeliveryMode()).isEqualTo(MessageDeliveryMode.PERSISTENT);
    }
}
